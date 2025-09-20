import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';

import {
  CustomSite,
  CustomSiteConfiguration,
  ConfigurationValidationResult,
  EncodedCustomSitePayloadV1,
  SecurityWarning
} from '../types';
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

const canonicalizePayload = (payload: NormalizedPayload): string => {
  const canonical: NormalizedPayload = {
    v: payload.v,
    h: payload.h,
    n: payload.n
  };

  if (payload.p) {
    canonical.p = {
      s: payload.p.s,
      pl: payload.p.pl
    };

    if (payload.p.ox !== undefined) {
      canonical.p.ox = payload.p.ox;
    }
    if (payload.p.oy !== undefined) {
      canonical.p.oy = payload.p.oy;
    }
    if (payload.p.z !== undefined) {
      canonical.p.z = payload.p.z;
    }
    if (payload.p.d !== undefined) {
      canonical.p.d = payload.p.d;
    }
  }

  return JSON.stringify(canonical);
};

const arrayBufferToHex = (buffer: ArrayBuffer): string => {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
};

const getSubtleCrypto = (): SubtleCrypto | null => {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  const potentialCrypto = (globalThis as { crypto?: Crypto }).crypto;
  return typeof potentialCrypto?.subtle !== 'undefined' ? potentialCrypto.subtle : null;
};

const computeChecksum = async (value: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);

  const subtle = getSubtleCrypto();
  if (subtle) {
    const digest = await subtle.digest('SHA-256', data);
    return arrayBufferToHex(digest).slice(0, 16);
  }

  // Fallback checksum (non-cryptographic) for environments without Web Crypto
  let hash = 0;
  for (const byte of data) {
    hash = (hash * 31 + byte) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const configToPayload = (config: CustomSiteConfiguration): NormalizedPayload => {
  const payload: NormalizedPayload = {
    v: CURRENT_VERSION,
    h: config.hostname,
    n: config.displayName
  };

  if (config.positioning && config.positioning.selector) {
    payload.p = {
      s: config.positioning.selector,
      pl: config.positioning.placement
    };

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

    if (VALID_PLACEMENTS.includes(placement) && typeof selector === 'string' && selector.trim().length > 0) {
      config.positioning = {
        mode: 'custom',
        selector,
        placement,
        offset: payload.p.ox !== undefined || payload.p.oy !== undefined ? {
          x: payload.p.ox ?? 0,
          y: payload.p.oy ?? 0
        } : undefined,
        zIndex: payload.p.z,
        description: payload.p.d
      };
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
      message: 'Hostname is required.',
      severity: 'error'
    });
  } else if (!HOSTNAME_PATTERN.test(sanitizedConfig.hostname)) {
    issues.push({
      field: 'hostname',
      message: 'Hostname must be a valid public domain.',
      severity: 'error'
    });
  }

  if (!sanitizedConfig.displayName) {
    issues.push({
      field: 'displayName',
      message: 'Display name is required.',
      severity: 'error'
    });
  }

  if (sanitizedConfig.positioning) {
    if (!sanitizedConfig.positioning.selector) {
      issues.push({
        field: 'positioning.selector',
        message: 'Selector is required when positioning is provided.',
        severity: 'error'
      });
    } else if (!isSelectorSafe(sanitizedConfig.positioning.selector)) {
      issues.push({
        field: 'positioning.selector',
        message: 'Selector contains unsafe characters or patterns.',
        severity: 'error'
      });
    }

    if (!VALID_PLACEMENTS.includes(sanitizedConfig.positioning.placement)) {
      issues.push({
        field: 'positioning.placement',
        message: 'Placement is not supported.',
        severity: 'error'
      });
    }

    if (sanitizedConfig.positioning.offset) {
      const { x, y } = sanitizedConfig.positioning.offset;
      if (!Number.isFinite(x) || Math.abs(x) > 500) {
        issues.push({
          field: 'positioning.offset.x',
          message: 'Offset X must be between -500 and 500.',
          severity: 'error'
        });
      }
      if (!Number.isFinite(y) || Math.abs(y) > 500) {
        issues.push({
          field: 'positioning.offset.y',
          message: 'Offset Y must be between -500 and 500.',
          severity: 'error'
        });
      }
    }

    if (sanitizedConfig.positioning.zIndex !== undefined) {
      const z = sanitizedConfig.positioning.zIndex;
      if (!Number.isInteger(z) || z < 0 || z > 2147483647) {
        issues.push({
          field: 'positioning.zIndex',
          message: 'Z-index must be an integer between 0 and 2147483647.',
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
    throw new ConfigurationEncoderError('Configuration code is empty', 'INVALID_FORMAT');
  }

  let serialized: string | null;
  try {
    serialized = decompressFromEncodedURIComponent(encodedString.trim());
  } catch (error) {
    console.error('Failed to decompress configuration string:', error);
    serialized = null;
  }

  if (!serialized) {
    throw new ConfigurationEncoderError('Invalid configuration code', 'INVALID_FORMAT');
  }

  let payload: EncodedCustomSitePayloadV1;
  try {
    payload = JSON.parse(serialized) as EncodedCustomSitePayloadV1;
  } catch (error) {
    console.error('Failed to parse configuration payload:', error);
    throw new ConfigurationEncoderError('Invalid configuration format', 'INVALID_FORMAT');
  }

  if (payload.v !== CURRENT_VERSION) {
    throw new ConfigurationEncoderError('Unsupported configuration version', 'UNSUPPORTED_VERSION');
  }

  const { c: receivedChecksum, ...rest } = payload;
  const canonical = canonicalizePayload(rest);
  const expectedChecksum = await computeChecksum(canonical);

  if (receivedChecksum !== expectedChecksum) {
    throw new ConfigurationEncoderError('Configuration checksum mismatch', 'CHECKSUM_FAILED');
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
