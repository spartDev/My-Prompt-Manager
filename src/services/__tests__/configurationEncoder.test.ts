import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { describe, expect, it } from 'vitest';

import type { CustomSite, CustomSiteConfiguration } from '../../types';
import { ConfigurationEncoder, ConfigurationEncoderError } from '../configurationEncoder';

describe('ConfigurationEncoder', () => {
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
      description: 'Place widget near the footer'
    }
  };

  it('encodes and decodes a configuration preserving core fields', async () => {
    const encoded = await ConfigurationEncoder.encode(baseCustomSite);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = await ConfigurationEncoder.decode(encoded);

    const expected: CustomSiteConfiguration = {
      hostname: 'example.com',
      displayName: 'Example Site',
      positioning: {
        mode: 'custom',
        selector: '#prompt-input',
        placement: 'inside-end',
        offset: { x: 12, y: -4 },
        zIndex: 1500,
        description: 'Place widget near the footer'
      }
    };

    expect(decoded).toEqual(expected);
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

    try {
      await ConfigurationEncoder.encode(maliciousSite);
      throw new Error('Expected encoding to fail for unsafe selector');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigurationEncoderError);
      expect(['SECURITY_VIOLATION', 'VALIDATION_ERROR']).toContain((error as ConfigurationEncoderError).code);
    }
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
});
