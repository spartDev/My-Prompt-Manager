/**
 * URL-Safe Encoding Strategy
 *
 * This module uses lz-string's compressToEncodedURIComponent for encoding configurations.
 * This provides several advantages:
 *
 * 1. **URL Safety**: Produces output safe for URLs, query parameters, and sharing
 * 2. **Compression**: Reduces payload size by ~60-80% compared to raw JSON
 * 3. **Unicode Support**: Handles international characters correctly
 * 4. **Battle-tested**: Used by thousands of projects, well-maintained
 *
 * The output is URL-safe because lz-string:
 * - Avoids '+', '/', '=' characters that require URL encoding
 * - Uses only alphanumeric characters and safe symbols
 * - No additional encoding needed for use in URLs
 *
 * Alternative: If you need simple base64 URL-safe encoding without compression,
 * use the utilities in src/utils/base64.ts
 */
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

import {
  CustomSite,
  CustomSiteConfiguration,
  ConfigurationValidationResult,
  EncodedCustomSitePayloadV1,
  ElementFingerprint,
  SecurityWarning
} from '../types';
import { Logger, toError } from '../utils';
import {
  detectMaliciousContent,
  isSelectorSafe,
  sanitizeConfiguration,
  HOSTNAME_PATTERN
} from '../utils/configurationSecurity';

type NormalizedPayload = Omit<EncodedCustomSitePayloadV1, 'c'>;

type ConfigurationErrorCode =
  | 'INVALID_FORMAT'
  | 'UNSUPPORTED_VERSION'
  | 'CHECKSUM_FAILED'
  | 'SECURITY_VIOLATION'
  | 'VALIDATION_ERROR';

export class ConfigurationEncoderError extends Error {
  public readonly code: ConfigurationErrorCode;

  constructor(message: string, code: ConfigurationErrorCode) {
    super(message);
    this.name = 'ConfigurationEncoderError';
    this.code = code;
  }
}

const CURRENT_VERSION = '1.0';
const VALID_PLACEMENTS: Array<NonNullable<CustomSite['positioning']>['placement']> = [
  'before',
  'after',
  'inside-start',
  'inside-end'
];
const CHECKSUM_LENGTH = 16;
const LEGACY_CHECKSUM_LENGTH = 8;
const MAX_FINGERPRINT_SIZE = 10000; // 10KB limit to prevent DOS attacks

const canonicalizeFingerprint = (fingerprint: ElementFingerprint): ElementFingerprint => {
  const canonical: ElementFingerprint = {
    primary: {},
    secondary: {
      tagName: fingerprint.secondary.tagName
    },
    content: {},
    context: {},
    attributes: {},
    meta: {
      generatedAt: fingerprint.meta.generatedAt,
      url: fingerprint.meta.url,
      confidence: fingerprint.meta.confidence
    }
  };

  const primaryKeys = ['id', 'dataTestId', 'dataId', 'name', 'ariaLabel'] as const;
  for (const key of primaryKeys) {
    const value = fingerprint.primary[key];
    if (value !== undefined) {
      canonical.primary[key] = value;
    }
  }

  const secondaryKeys = ['type', 'role', 'placeholder'] as const;
  for (const key of secondaryKeys) {
    const value = fingerprint.secondary[key];
    if (value !== undefined) {
      canonical.secondary[key] = value;
    }
  }

  const contentKeys = ['textContent', 'textHash'] as const;
  for (const key of contentKeys) {
    const value = fingerprint.content[key];
    if (value !== undefined) {
      canonical.content[key] = value;
    }
  }

  const contextKeys = ['parentId', 'parentDataTestId', 'parentTagName', 'siblingIndex', 'siblingCount', 'depth'] as const;
  for (const key of contextKeys) {
    const value = fingerprint.context[key];
    if (value !== undefined) {
      canonical.context[key] = value;
    }
  }

  const attributeKeys = Object.keys(fingerprint.attributes).sort();
  for (const key of attributeKeys) {
    canonical.attributes[key] = fingerprint.attributes[key];
  }

  if (fingerprint.classPatterns && fingerprint.classPatterns.length > 0) {
    canonical.classPatterns = [...fingerprint.classPatterns].sort();
  }

  return canonical;
};

const canonicalizePayload = (payload: NormalizedPayload): string => {
  const canonical: NormalizedPayload = {
    v: payload.v,
    h: payload.h,
    n: payload.n
  };

  if (payload.p) {
    const canonicalPositioning: Partial<NonNullable<NormalizedPayload['p']>> = {};

    if (payload.p.s !== undefined) {
      canonicalPositioning.s = payload.p.s;
    }

    if (payload.p.fp) {
      canonicalPositioning.fp = canonicalizeFingerprint(payload.p.fp);
    }

    canonicalPositioning.pl = payload.p.pl;

    if (payload.p.ox !== undefined) {
      canonicalPositioning.ox = payload.p.ox;
    }
    if (payload.p.oy !== undefined) {
      canonicalPositioning.oy = payload.p.oy;
    }
    if (payload.p.z !== undefined) {
      canonicalPositioning.z = payload.p.z;
    }
    if (payload.p.d !== undefined) {
      canonicalPositioning.d = payload.p.d;
    }

    canonical.p = canonicalPositioning as NonNullable<NormalizedPayload['p']>;
  }

  return JSON.stringify(canonical);
};

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

const toUtf8Bytes = (value: string): Uint8Array => new TextEncoder().encode(value);

const getSubtleCrypto = (): SubtleCrypto | null => {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  const potentialCrypto = (globalThis as { crypto?: Crypto }).crypto;
  return typeof potentialCrypto?.subtle !== 'undefined' ? potentialCrypto.subtle : null;
};

const computeLegacyChecksum = (data: Uint8Array): string => {
  let hash = 0;
  for (const byte of data) {
    hash = (Math.imul(hash, 31) + byte) >>> 0;
  }
  return hash.toString(16).padStart(LEGACY_CHECKSUM_LENGTH, '0');
};

const computeFallbackChecksum = (data: Uint8Array): string => {
  let hashA = 0;
  let hashB = 0;

  for (const byte of data) {
    hashA = (Math.imul(hashA, 31) + byte) >>> 0;
    hashB = (Math.imul(hashB, 33) ^ byte) >>> 0;
  }

  const partA = hashA.toString(16).padStart(LEGACY_CHECKSUM_LENGTH, '0');
  const partB = hashB.toString(16).padStart(LEGACY_CHECKSUM_LENGTH, '0');
  return `${partA}${partB}`;
};

const computeChecksumFromBytes = async (data: Uint8Array): Promise<string> => {
  const subtle = getSubtleCrypto();
  if (subtle) {
    const digest = await subtle.digest('SHA-256', data);
    return arrayBufferToHex(digest).slice(0, CHECKSUM_LENGTH);
  }

  return computeFallbackChecksum(data);
};

const computeChecksum = async (value: string): Promise<string> => {
  const data = toUtf8Bytes(value);
  return computeChecksumFromBytes(data);
};

const configToPayload = (config: CustomSiteConfiguration): NormalizedPayload => {
  const payload: NormalizedPayload = {
    v: CURRENT_VERSION,
    h: config.hostname,
    n: config.displayName
  };

  if (config.positioning && (config.positioning.selector !== undefined || config.positioning.fingerprint)) {
    payload.p = {
      pl: config.positioning.placement
    };

    if (config.positioning.selector !== undefined) {
      payload.p.s = config.positioning.selector;
    }

    if (config.positioning.fingerprint) {
      payload.p.fp = config.positioning.fingerprint;
    }

    if (config.positioning.offset) {
      const { x, y } = config.positioning.offset;
      if (x !== 0) {
        payload.p.ox = x;
      }
      if (y !== 0) {
        payload.p.oy = y;
      }
    }

    if (config.positioning.zIndex !== undefined) {
      payload.p.z = config.positioning.zIndex;
    }

    if (config.positioning.description) {
      payload.p.d = config.positioning.description;
    }
  }

  return payload;
};

const payloadToConfig = (payload: NormalizedPayload): CustomSiteConfiguration => {
  const config: CustomSiteConfiguration = {
    hostname: payload.h,
    displayName: payload.n
  };

  if (payload.p) {
    const placement = payload.p.pl;
    const selector = payload.p.s;
    const fingerprint = payload.p.fp;
    const hasSelector = typeof selector === 'string' && selector.trim().length > 0;
    const hasFingerprint = Boolean(fingerprint);

    if (VALID_PLACEMENTS.includes(placement) && (hasSelector || hasFingerprint)) {
      config.positioning = {
        mode: 'custom',
        placement,
        selector: hasSelector ? selector : '',
        offset: payload.p.ox !== undefined || payload.p.oy !== undefined ? {
          x: payload.p.ox ?? 0,
          y: payload.p.oy ?? 0
        } : undefined,
        zIndex: payload.p.z,
        description: payload.p.d
      };

      if (hasFingerprint) {
        config.positioning.fingerprint = fingerprint;
      }
    }
  }

  return config;
};

const raiseSecurityError = (warnings: SecurityWarning[]): never => {
  const message = warnings.map(warning => `${warning.field}: ${warning.message}`).join('\n');
  throw new ConfigurationEncoderError(message || 'Configuration failed security validation', 'SECURITY_VIOLATION');
};

const validateConfiguration = (config: CustomSiteConfiguration): ConfigurationValidationResult => {
  const sanitizedConfig = sanitizeConfiguration(config);
  const warnings = detectMaliciousContent(sanitizedConfig);

  const issues: ConfigurationValidationResult['issues'] = [];

  if (!sanitizedConfig.hostname) {
    issues.push({
      field: 'hostname',
      message: 'Hostname is required. Please enter the domain name (e.g., "example.com") without protocol or path.',
      severity: 'error'
    });
  } else if (!HOSTNAME_PATTERN.test(sanitizedConfig.hostname)) {
    issues.push({
      field: 'hostname',
      message: 'Hostname must be a valid public domain (e.g., "example.com", "subdomain.example.com"). Do not include protocol (http://) or path (/page).',
      severity: 'error'
    });
  }

  if (!sanitizedConfig.displayName) {
    issues.push({
      field: 'displayName',
      message: 'Display name is required. Provide a friendly name for this site configuration (e.g., "My Custom Blog", "Company Portal").',
      severity: 'error'
    });
  }

  if (sanitizedConfig.positioning) {
    const selectorValue = sanitizedConfig.positioning.selector;
    const hasSelector = typeof selectorValue === 'string' && selectorValue.trim().length > 0;
    const hasFingerprint = Boolean(sanitizedConfig.positioning.fingerprint);

    if (!hasSelector && !hasFingerprint) {
      issues.push({
        field: 'positioning.selector',
        message: 'Provide a CSS selector (e.g., "#submit-button", ".chat-input") or use the element picker to create a fingerprint. At least one is required for positioning.',
        severity: 'error'
      });
    } else if (hasSelector && !isSelectorSafe(selectorValue)) {
      issues.push({
        field: 'positioning.selector',
        message: 'Selector contains unsafe characters or patterns. Use simple CSS selectors like "#id", ".class", or "tag[attribute]". Avoid script injection patterns.',
        severity: 'error'
      });
    }

    // Validate fingerprint size to prevent DOS attacks
    if (hasFingerprint && sanitizedConfig.positioning.fingerprint) {
      try {
        const fingerprintJson = JSON.stringify(sanitizedConfig.positioning.fingerprint);
        if (fingerprintJson.length > MAX_FINGERPRINT_SIZE) {
          issues.push({
            field: 'positioning.fingerprint',
            message: `Fingerprint exceeds maximum size of ${String(MAX_FINGERPRINT_SIZE)} bytes (current: ${String(fingerprintJson.length)} bytes).`,
            severity: 'error'
          });
        }
      } catch {
        issues.push({
          field: 'positioning.fingerprint',
          message: 'Fingerprint contains invalid data that cannot be serialized.',
          severity: 'error'
        });
      }
    }

    if (!VALID_PLACEMENTS.includes(sanitizedConfig.positioning.placement)) {
      issues.push({
        field: 'positioning.placement',
        message: `Placement must be one of: ${VALID_PLACEMENTS.join(', ')}. Choose where to position the icon relative to the target element.`,
        severity: 'error'
      });
    }

    if (sanitizedConfig.positioning.offset) {
      const { x, y } = sanitizedConfig.positioning.offset;
      if (!Number.isFinite(x) || Math.abs(x) > 500) {
        issues.push({
          field: 'positioning.offset.x',
          message: 'Offset X must be between -500 and 500 pixels. Use positive values to move right, negative to move left.',
          severity: 'error'
        });
      }
      if (!Number.isFinite(y) || Math.abs(y) > 500) {
        issues.push({
          field: 'positioning.offset.y',
          message: 'Offset Y must be between -500 and 500 pixels. Use positive values to move down, negative to move up.',
          severity: 'error'
        });
      }
    }

    if (sanitizedConfig.positioning.zIndex !== undefined) {
      const z = sanitizedConfig.positioning.zIndex;
      if (!Number.isInteger(z) || z < 0 || z > 2147483647) {
        issues.push({
          field: 'positioning.zIndex',
          message: 'Z-index must be an integer between 0 and 2147483647. Higher values appear above lower values. Try 999999 for most cases.',
          severity: 'error'
        });
      }
    }
  }

  const isValid = issues.every(issue => issue.severity !== 'error') && warnings.every(warning => warning.severity !== 'error');

  return {
    isValid,
    issues,
    warnings,
    sanitizedConfig
  };
};

const encode = async (customSite: CustomSite): Promise<string> => {
  const rawConfig: CustomSiteConfiguration = {
    hostname: customSite.hostname,
    displayName: customSite.displayName,
    positioning: customSite.positioning
      ? {
          ...customSite.positioning,
          offset: customSite.positioning.offset
            ? { ...customSite.positioning.offset }
            : undefined
        }
      : undefined
  };

  const validation = validateConfiguration(rawConfig);

  if (!validation.isValid) {
    const issues = validation.issues.filter(issue => issue.severity === 'error');
    const message = issues.map(issue => `${issue.field}: ${issue.message}`).join('\n') || 'Configuration is invalid';
    throw new ConfigurationEncoderError(message, 'VALIDATION_ERROR');
  }

  const blockingWarnings = validation.warnings.filter(warning => warning.severity === 'error');
  if (blockingWarnings.length > 0) {
    raiseSecurityError(blockingWarnings);
  }

  const payload = configToPayload(validation.sanitizedConfig);
  const canonical = canonicalizePayload(payload);
  const checksum = await computeChecksum(canonical);

  const encodedPayload: EncodedCustomSitePayloadV1 = {
    ...payload,
    c: checksum
  };

  const serialized = JSON.stringify(encodedPayload);
  const encoded = compressToEncodedURIComponent(serialized);

  if (!encoded) {
    throw new ConfigurationEncoderError('Failed to encode configuration', 'INVALID_FORMAT');
  }

  return encoded;
};

const decode = async (encodedString: string): Promise<CustomSiteConfiguration> => {
  if (!encodedString || encodedString.trim().length === 0) {
    throw new ConfigurationEncoderError('Configuration code is empty. Please paste a valid configuration code from the sharing dialog.', 'INVALID_FORMAT');
  }

  let serialized: string | null;
  try {
    serialized = decompressFromEncodedURIComponent(encodedString.trim());
  } catch (error) {
    Logger.error('Failed to decompress configuration string', toError(error));
    serialized = null;
  }

  if (!serialized) {
    throw new ConfigurationEncoderError('Invalid configuration code. The code may be corrupted or incomplete. Please copy the entire code from the sharing dialog.', 'INVALID_FORMAT');
  }

  let payload: EncodedCustomSitePayloadV1;
  try {
    payload = JSON.parse(serialized) as EncodedCustomSitePayloadV1;
  } catch (error) {
    Logger.error('Failed to parse configuration payload', toError(error));
    throw new ConfigurationEncoderError('Invalid configuration format. The configuration data is corrupted. Please request a new sharing code.', 'INVALID_FORMAT');
  }

  if (payload.v !== CURRENT_VERSION) {
    throw new ConfigurationEncoderError(`Unsupported configuration version (v${payload.v}). This code was created with a different version. Please create a new configuration or update the extension.`, 'UNSUPPORTED_VERSION');
  }

  // Early validation: Check fingerprint size before expensive checksum computation
  if (payload.p?.fp) {
    try {
      const fingerprintJson = JSON.stringify(payload.p.fp);
      if (fingerprintJson.length > MAX_FINGERPRINT_SIZE) {
        throw new ConfigurationEncoderError(
          `Fingerprint exceeds maximum size of ${String(MAX_FINGERPRINT_SIZE)} bytes`,
          'VALIDATION_ERROR'
        );
      }
    } catch (error) {
      if (error instanceof ConfigurationEncoderError) {
        throw error;
      }
      throw new ConfigurationEncoderError('Fingerprint contains invalid data', 'VALIDATION_ERROR');
    }
  }

  const { c: receivedChecksum, ...rest } = payload;
  const canonical = canonicalizePayload(rest);
  const canonicalBytes = toUtf8Bytes(canonical);
  const expectedChecksum = await computeChecksumFromBytes(canonicalBytes);

  if (receivedChecksum !== expectedChecksum) {
    const legacyMatch =
      receivedChecksum.length === LEGACY_CHECKSUM_LENGTH &&
      computeLegacyChecksum(canonicalBytes) === receivedChecksum;
    const fallbackMatch = receivedChecksum === computeFallbackChecksum(canonicalBytes);

    if (!legacyMatch && !fallbackMatch) {
      throw new ConfigurationEncoderError('Configuration integrity check failed. The code may have been modified or corrupted during copying. Please copy the code again carefully.', 'CHECKSUM_FAILED');
    }
  }

  const decodedConfig = payloadToConfig(rest);
  const validation = validateConfiguration(decodedConfig);

  if (!validation.isValid) {
    const issues = validation.issues.filter(issue => issue.severity === 'error');
    const message = issues.map(issue => `${issue.field}: ${issue.message}`).join('\n') || 'Configuration is invalid';
    throw new ConfigurationEncoderError(message, 'VALIDATION_ERROR');
  }

  const blockingWarnings = validation.warnings.filter(warning => warning.severity === 'error');
  if (blockingWarnings.length > 0) {
    raiseSecurityError(blockingWarnings);
  }

  return validation.sanitizedConfig;
};

const ConfigurationEncoder = {
  encode,
  decode,
  validate: validateConfiguration
} as const;

export { ConfigurationEncoder };
export type { ConfigurationErrorCode };
