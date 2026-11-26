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

  // What a pick keeps since My-Prompt-Manager-je37: no page address, no text
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
    content: {},
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

  // My-Prompt-Manager-je37: a pick stored before the change, and a code made before it
  describe('a Custom site picked before je37', () => {
    const DRAFT = 'Draft: merger closes Friday';
    const EMAIL = ['jane.doe', 'example.org'].join('@');
    const OPAQUE = ['a8f3c2e1', 'b7d94e06'].join('');
    const UUID = ['e5f6a7b8', '1c2d', '4e5f', '8a9b', '0c1d2e3f4a5b'].join('-');
    const PAGE = `https://example.com/workspace/42?email=${encodeURIComponent(EMAIL)}#reply-7c1d`;
    const PRIVATE = [PAGE, '/workspace/42', '?email', encodeURIComponent(EMAIL), EMAIL, '#reply-7c1d', DRAFT, 'merger', 'hello', OPAQUE, UUID];

    /** The fingerprint 2.0.0 stored for a composer picked while it held a draft */
    const storedFingerprint: ElementFingerprint = {
      primary: { id: 'prompt-input', dataTestId: 'composer-input', dataId: OPAQUE, ariaLabel: 'Write a message' },
      secondary: { tagName: 'textarea', placeholder: 'Type your message' },
      content: { textContent: DRAFT, textHash: 'icuibp' },
      context: { parentId: UUID, parentTagName: 'div', siblingIndex: 0, siblingCount: 1, depth: 4 },
      attributes: { 'data-draft': 'hello', 'data-id': OPAQUE, 'data-testid': 'composer-input', 'aria-multiline': 'true' },
      classPatterns: ['composer'],
      meta: { generatedAt: 1_760_000_000_000, url: PAGE, confidence: 'high' }
    };

    /** What a configuration code keeps of it */
    const keptFingerprint: ElementFingerprint = {
      primary: { id: 'prompt-input', dataTestId: 'composer-input', ariaLabel: 'Write a message' },
      secondary: { tagName: 'textarea', placeholder: 'Type your message' },
      content: {},
      context: { parentTagName: 'div', siblingIndex: 0, siblingCount: 1, depth: 4 },
      attributes: { 'data-testid': 'composer-input', 'aria-multiline': 'true' },
      classPatterns: ['composer'],
      meta: { generatedAt: 1_760_000_000_000, confidence: 'high' }
    };

    const storedSite = (selector: string | undefined, fingerprint: ElementFingerprint | undefined): CustomSite => ({
      hostname: 'example.com',
      displayName: 'Example Site',
      enabled: true,
      dateAdded: 1_760_000_000_000,
      positioning: {
        mode: 'custom',
        placement: 'before',
        ...(selector === undefined ? {} : { selector }),
        ...(fingerprint ? { fingerprint } : {})
      }
    });

    const expectNoneOf = (serialized: string) => {
      for (const value of PRIVATE) {
        expect(serialized, `holds "${value}"`).not.toContain(value);
      }
    };

    it('exports neither the page address, nor the text, nor a value a pick no longer keeps, and keeps the rest', async () => {
      const encoded = await ConfigurationEncoder.encode(storedSite('#prompt-input', storedFingerprint));

      expectNoneOf(decompressFromEncodedURIComponent(encoded) ?? '');
      const decoded = await ConfigurationEncoder.decode(encoded);
      expectNoneOf(JSON.stringify(decoded));
      expect(decoded.positioning?.fingerprint).toEqual(keptFingerprint);
      expect(decoded.positioning?.selector).toBe('#prompt-input');
    });

    it.each([
      ['a draft copied into data-draft', 'textarea[data-draft="hello"]'],
      ['a token in data-id', `textarea[data-id="${OPAQUE}"]`],
      ["a session id on an ancestor", `#${UUID} > div > textarea`],
      ['an e-mail address in an escaped id', `#${EMAIL.replace(/[.@]/g, (character) => `\\${character}`)}`]
    ])('leaves out a selector that names %s, and the fingerprint places the button', async (_name, selector) => {
      const encoded = await ConfigurationEncoder.encode(storedSite(selector, storedFingerprint));

      expectNoneOf(decompressFromEncodedURIComponent(encoded) ?? '');
      const decoded = await ConfigurationEncoder.decode(encoded);
      expect(decoded.positioning?.selector).toBe('');
      expect(decoded.positioning?.fingerprint).toEqual(keptFingerprint);
    });

    it('refuses to export a site whose only selector names such a value: there is nothing left to place the button by', async () => {
      await expect(ConfigurationEncoder.encode(storedSite('textarea[data-draft="hello"]', undefined))).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('positioning.selector')
      });
    });

    /** A configuration code as an earlier release made it, its checksum included */
    const codeOf = async (positioning: NonNullable<EncodedCustomSitePayloadV1['p']>): Promise<string> => {
      const payload: Omit<EncodedCustomSitePayloadV1, 'c'> = { v: '1.0', h: 'example.com', n: 'Example Site', p: positioning };
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalizePayloadForTest(payload)));
      const checksum = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('').slice(0, 16);
      return compressToEncodedURIComponent(JSON.stringify({ ...payload, c: checksum }));
    };

    it('decodes a code made before je37, checksum included, and keeps neither the page address nor the text', async () => {
      const decoded = await ConfigurationEncoder.decode(await codeOf({ pl: 'before', s: '#prompt-input', fp: storedFingerprint }));

      expectNoneOf(JSON.stringify(decoded));
      expect(decoded.positioning?.fingerprint).toEqual(keptFingerprint);
      expect(decoded.positioning?.selector).toBe('#prompt-input');
    });

    // Releases up to 1.4.2 stored a selector and no fingerprint, and from 1.3.0 shared it so
    it('refuses to import a code holding only a selector that names a value a pick no longer keeps', async () => {
      const code = await codeOf({ pl: 'before', s: 'textarea[data-draft="hello"]' });

      await expect(ConfigurationEncoder.decode(code)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('Provide a CSS selector')
      });
    });

    it('imports a code holding only a selector that names values a pick keeps', async () => {
      const decoded = await ConfigurationEncoder.decode(await codeOf({ pl: 'before', s: 'textarea[data-testid="chat-input"]' }));

      expect(decoded.positioning?.selector).toBe('textarea[data-testid="chat-input"]');
    });

    // Review of je37: a run of `[` made the rule backtrack, 14.5 s for 32,000 of them
    it('refuses as unsafe, at once, a code whose selector is a run of 32,000 [', async () => {
      const code = await codeOf({ pl: 'before', s: '['.repeat(32_000), fp: storedFingerprint });

      await expect(ConfigurationEncoder.decode(code)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
        message: expect.stringContaining('Selector contains unsafe characters or patterns')
      });
    });
  });
});
