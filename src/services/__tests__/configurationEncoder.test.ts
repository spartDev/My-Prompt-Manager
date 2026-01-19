import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CustomSite,
  CustomSiteConfiguration,
  ElementFingerprint,
  EncodedCustomSitePayloadV1
} from '../../types';
import { ConfigurationEncoder, ConfigurationEncoderError } from '../configurationEncoder';

const canonicalizeFingerprintForTest = (fingerprint: ElementFingerprint): ElementFingerprint => {
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
      (canonical.context as Record<string, string | number | undefined>)[key] = value;
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

const canonicalizePayloadForTest = (payload: Omit<EncodedCustomSitePayloadV1, 'c'>): string => {
  const canonical: Omit<EncodedCustomSitePayloadV1, 'c'> = {
    v: payload.v,
    h: payload.h,
    n: payload.n
  };

  if (payload.p) {
    const canonicalPositioning: Partial<NonNullable<EncodedCustomSitePayloadV1['p']>> = {};

    if (payload.p.s !== undefined) {
      canonicalPositioning.s = payload.p.s;
    }

    if (payload.p.fp) {
      canonicalPositioning.fp = canonicalizeFingerprintForTest(payload.p.fp);
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

    canonical.p = canonicalPositioning as NonNullable<EncodedCustomSitePayloadV1['p']>;
  }

  return JSON.stringify(canonical);
};

const computeLegacyChecksumForTest = (value: string): string => {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);

  let hash = 0;
  for (const byte of data) {
    hash = (Math.imul(hash, 31) + byte) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
};

describe('ConfigurationEncoder', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const sampleFingerprint: ElementFingerprint = {
    primary: {
      id: 'prompt-input',
      dataTestId: 'composer-input'
    },
    secondary: {
      tagName: 'textarea',
      role: 'textbox',
      placeholder: 'Type your message'
    },
    content: {
      textHash: 'abc123'
    },
    context: {
      parentId: 'composer-root',
      siblingIndex: 2,
      siblingCount: 4,
      depth: 6
    },
    attributes: {
      'aria-controls': 'composer-input',
      'data-role': 'prompt-input'
    },
    classPatterns: ['composer', 'input'],
    meta: {
      generatedAt: 1700000000000,
      url: 'https://example.com/chat',
      confidence: 'high'
    }
  };

  const baseCustomSite: CustomSite = {
    hostname: 'example.com',
    displayName: 'Example Site',
    enabled: true,
    dateAdded: Date.now(),
    positioning: {
      mode: 'custom',
      selector: '#prompt-input',
      placement: 'inside-end',
      offset: { x: 12, y: -4 },
      zIndex: 1500,
      description: 'Place widget near the footer',
      fingerprint: sampleFingerprint
    }
  };

  const expectedConfiguration: CustomSiteConfiguration = {
    hostname: 'example.com',
    displayName: 'Example Site',
    positioning: {
      mode: 'custom',
      selector: '#prompt-input',
      placement: 'inside-end',
      offset: { x: 12, y: -4 },
      zIndex: 1500,
      description: 'Place widget near the footer',
      fingerprint: sampleFingerprint
    }
  };

  it('encodes and decodes a configuration preserving core fields', async () => {
    const encoded = await ConfigurationEncoder.encode(baseCustomSite);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = await ConfigurationEncoder.decode(encoded);

    expect(decoded).toEqual(expectedConfiguration);
  });

  it('rejects invalid encoded strings', async () => {
    await expect(ConfigurationEncoder.decode('not-a-valid-code')).rejects.toMatchObject({
      code: 'INVALID_FORMAT'
    });
  });

  it('detects tampered payloads using checksum', async () => {
    const encoded = await ConfigurationEncoder.encode(baseCustomSite);
    const serialized = decompressFromEncodedURIComponent(encoded);
    if (!serialized) {
      throw new Error('Failed to decompress test payload');
    }
    const payload = JSON.parse(serialized) as Record<string, unknown>;
    payload.n = 'Tampered Name';
    const tampered = compressToEncodedURIComponent(JSON.stringify(payload));

    await expect(ConfigurationEncoder.decode(tampered)).rejects.toMatchObject({
      code: 'CHECKSUM_FAILED'
    });
  });

  it('blocks configurations with unsafe selectors', async () => {
    const maliciousSite: CustomSite = {
      ...baseCustomSite,
      positioning: {
        mode: 'custom',
        selector: 'input[href="javascript:alert(1)"]',
        placement: 'before'
      }
    };

    await expect(ConfigurationEncoder.encode(maliciousSite)).rejects.toSatisfy(
      (error: ConfigurationEncoderError) =>
        error instanceof ConfigurationEncoderError &&
        ['SECURITY_VIOLATION', 'VALIDATION_ERROR'].includes(error.code)
    );
  });

  it('supports configurations that rely solely on fingerprints', async () => {
    const fingerprintOnlySite: CustomSite = {
      ...baseCustomSite,
      positioning: {
        mode: 'custom',
        fingerprint: sampleFingerprint,
        placement: 'inside-end'
      }
    };

    const encoded = await ConfigurationEncoder.encode(fingerprintOnlySite);
    const decoded = await ConfigurationEncoder.decode(encoded);

    expect(decoded.positioning?.fingerprint).toBeDefined();
    expect(decoded.positioning?.selector).toBe('');
    expect(decoded.positioning?.fingerprint?.secondary.tagName).toBe('textarea');
  });

  it('reports validation issues for incomplete payloads', () => {
    const config: CustomSiteConfiguration = {
      hostname: '',
      displayName: '',
      positioning: {
        mode: 'custom',
        selector: '',
        placement: 'before'
      }
    };

    const result = ConfigurationEncoder.validate(config);

    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'hostname' }),
        expect.objectContaining({ field: 'displayName' }),
        expect.objectContaining({ field: 'positioning.selector' })
      ])
    );
  });

  it('decodes payloads that were generated with the legacy checksum', async () => {
    const encoded = await ConfigurationEncoder.encode(baseCustomSite);
    const serialized = decompressFromEncodedURIComponent(encoded);
    if (!serialized) {
      throw new Error('Failed to decompress encoded payload');
    }

    const payload = JSON.parse(serialized) as EncodedCustomSitePayloadV1;
    const { c: _currentChecksum, ...rest } = payload;
    const canonical = canonicalizePayloadForTest(rest);
    const legacyChecksum = computeLegacyChecksumForTest(canonical);

    const legacyPayload: EncodedCustomSitePayloadV1 = {
      ...rest,
      c: legacyChecksum
    };

    const legacyEncoded = compressToEncodedURIComponent(JSON.stringify(legacyPayload));
    const decoded = await ConfigurationEncoder.decode(legacyEncoded);

    expect(decoded).toEqual(expectedConfiguration);
  });

  it('falls back to a deterministic checksum when Web Crypto is unavailable', async () => {
    const cryptoGetterSpy = vi.spyOn(globalThis, 'crypto', 'get').mockReturnValue(undefined as unknown as Crypto);

    const encodedWithoutWebCrypto = await ConfigurationEncoder.encode(baseCustomSite);

    cryptoGetterSpy.mockRestore();

    const serialized = decompressFromEncodedURIComponent(encodedWithoutWebCrypto);
    if (!serialized) {
      throw new Error('Failed to decompress fallback payload');
    }

    const payload = JSON.parse(serialized) as EncodedCustomSitePayloadV1;
    expect(payload.c).toMatch(/^[0-9a-f]{16}$/);

    const decoded = await ConfigurationEncoder.decode(encodedWithoutWebCrypto);
    expect(decoded).toEqual(expectedConfiguration);
  });
});
