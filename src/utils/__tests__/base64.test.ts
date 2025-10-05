import { describe, it, expect } from 'vitest';

import {
  encodeBase64UrlSafe,
  decodeBase64UrlSafe,
  encodeObjectToBase64UrlSafe,
  decodeObjectFromBase64UrlSafe,
  isValidBase64UrlSafe
} from '../base64';

describe('base64 utilities', () => {
  describe('encodeBase64UrlSafe', () => {
    it('should encode simple strings', () => {
      expect(encodeBase64UrlSafe('Hello World!')).toBe('SGVsbG8gV29ybGQh');
      expect(encodeBase64UrlSafe('test')).toBe('dGVzdA');
      expect(encodeBase64UrlSafe('')).toBe('');
    });

    it('should replace + with -', () => {
      // Input that produces + in standard base64
      const input = 'subject?>test';
      const encoded = encodeBase64UrlSafe(input);
      expect(encoded).not.toContain('+');
      expect(encoded).toContain('-');
    });

    it('should replace / with _', () => {
      // Input that produces / in standard base64
      const input = 'subjects?test';
      const encoded = encodeBase64UrlSafe(input);
      expect(encoded).not.toContain('/');
      expect(encoded).toContain('_');
    });

    it('should remove = padding', () => {
      // Various lengths that produce different padding
      expect(encodeBase64UrlSafe('a')).not.toContain('=');
      expect(encodeBase64UrlSafe('ab')).not.toContain('=');
      expect(encodeBase64UrlSafe('abc')).not.toContain('=');
    });

    it('should handle special characters', () => {
      const input = '{"name":"test","value":123}';
      const encoded = encodeBase64UrlSafe(input);
      expect(encoded).toBeTruthy();
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('should handle unicode characters', () => {
      const input = 'Hello 世界 🌍';
      const encoded = encodeBase64UrlSafe(input);
      expect(encoded).toBeTruthy();
      // Should be decodable
      const decoded = decodeBase64UrlSafe(encoded);
      expect(decoded).toBe(input);
    });
  });

  describe('decodeBase64UrlSafe', () => {
    it('should decode simple strings', () => {
      expect(decodeBase64UrlSafe('SGVsbG8gV29ybGQh')).toBe('Hello World!');
      expect(decodeBase64UrlSafe('dGVzdA')).toBe('test');
      expect(decodeBase64UrlSafe('')).toBe('');
    });

    it('should handle strings without padding', () => {
      // Encoded 'test' without padding
      expect(decodeBase64UrlSafe('dGVzdA')).toBe('test');
      // Encoded 'a' without padding
      expect(decodeBase64UrlSafe('YQ')).toBe('a');
    });

    it('should handle - and _ characters', () => {
      // Create a URL-safe encoded string with - and _
      const original = 'subject?>test';
      const encoded = encodeBase64UrlSafe(original);
      const decoded = decodeBase64UrlSafe(encoded);
      expect(decoded).toBe(original);
    });

    it('should be inverse of encode', () => {
      const testStrings = [
        'Hello World!',
        'test@example.com',
        '{"key":"value"}',
        'a',
        'ab',
        'abc',
        'subject?>test',
        'subjects?test'
      ];

      for (const input of testStrings) {
        const encoded = encodeBase64UrlSafe(input);
        const decoded = decodeBase64UrlSafe(encoded);
        expect(decoded).toBe(input);
      }
    });
  });

  describe('encodeObjectToBase64UrlSafe', () => {
    it('should encode simple objects', () => {
      const obj = { name: 'test', value: 123 };
      const encoded = encodeObjectToBase64UrlSafe(obj);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
      expect(encoded).not.toContain('+');
      expect(encoded).not.toContain('/');
      expect(encoded).not.toContain('=');
    });

    it('should encode nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          settings: {
            theme: 'dark',
            notifications: true
          }
        }
      };
      const encoded = encodeObjectToBase64UrlSafe(obj);
      expect(encoded).toBeTruthy();
    });

    it('should encode arrays', () => {
      const obj = {
        items: [1, 2, 3],
        names: ['a', 'b', 'c']
      };
      const encoded = encodeObjectToBase64UrlSafe(obj);
      expect(encoded).toBeTruthy();
    });

    it('should handle empty objects', () => {
      expect(encodeObjectToBase64UrlSafe({})).toBeTruthy();
      expect(encodeObjectToBase64UrlSafe([])).toBeTruthy();
    });
  });

  describe('decodeObjectFromBase64UrlSafe', () => {
    it('should decode simple objects', () => {
      const original = { name: 'test', value: 123 };
      const encoded = encodeObjectToBase64UrlSafe(original);
      const decoded = decodeObjectFromBase64UrlSafe(encoded) as typeof original;
      expect(decoded).toEqual(original);
    });

    it('should decode nested objects', () => {
      const original = {
        user: {
          name: 'John',
          settings: {
            theme: 'dark',
            notifications: true
          }
        }
      };
      const encoded = encodeObjectToBase64UrlSafe(original);
      const decoded = decodeObjectFromBase64UrlSafe(encoded) as typeof original;
      expect(decoded).toEqual(original);
    });

    it('should decode arrays', () => {
      const original = {
        items: [1, 2, 3],
        names: ['a', 'b', 'c']
      };
      const encoded = encodeObjectToBase64UrlSafe(original);
      const decoded = decodeObjectFromBase64UrlSafe(encoded) as typeof original;
      expect(decoded).toEqual(original);
    });

    it('should preserve types', () => {
      const original = {
        string: 'text',
        number: 42,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        object: { nested: 'value' }
      };
      const encoded = encodeObjectToBase64UrlSafe(original);
      const decoded = decodeObjectFromBase64UrlSafe(encoded) as typeof original;
      expect(decoded).toEqual(original);
      expect(typeof decoded.string).toBe('string');
      expect(typeof decoded.number).toBe('number');
      expect(typeof decoded.boolean).toBe('boolean');
      expect(decoded.null).toBeNull();
      expect(Array.isArray(decoded.array)).toBe(true);
      expect(typeof decoded.object).toBe('object');
    });
  });

  describe('isValidBase64UrlSafe', () => {
    it('should validate correct URL-safe base64 strings', () => {
      expect(isValidBase64UrlSafe('SGVsbG8gV29ybGQh')).toBe(true);
      expect(isValidBase64UrlSafe('dGVzdA')).toBe(true);
      expect(isValidBase64UrlSafe('YQ')).toBe(true);
      expect(isValidBase64UrlSafe('')).toBe(true);
      expect(isValidBase64UrlSafe('ABC123-_')).toBe(true);
    });

    it('should reject invalid characters', () => {
      expect(isValidBase64UrlSafe('Hello World!')).toBe(false);
      expect(isValidBase64UrlSafe('test+value')).toBe(false);
      expect(isValidBase64UrlSafe('test/value')).toBe(false);
      expect(isValidBase64UrlSafe('test=value')).toBe(false);
      expect(isValidBase64UrlSafe('test@value')).toBe(false);
      expect(isValidBase64UrlSafe('test value')).toBe(false);
    });

    it('should accept - and _ characters', () => {
      expect(isValidBase64UrlSafe('test-value')).toBe(true);
      expect(isValidBase64UrlSafe('test_value')).toBe(true);
      expect(isValidBase64UrlSafe('test-value_123')).toBe(true);
    });
  });

  describe('round-trip encoding/decoding', () => {
    it('should handle configuration objects', () => {
      const config = {
        hostname: 'example.com',
        displayName: 'Example Site',
        positioning: {
          mode: 'custom' as const,
          placement: 'after' as const,
          selector: '#submit-button',
          offset: { x: 10, y: 20 },
          zIndex: 999999
        }
      };

      const encoded = encodeObjectToBase64UrlSafe(config);
      expect(isValidBase64UrlSafe(encoded)).toBe(true);

      const decoded = decodeObjectFromBase64UrlSafe<typeof config>(encoded);
      expect(decoded).toEqual(config);
    });

    it('should handle large objects', () => {
      const largeObj = {
        data: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
          value: Math.random()
        }))
      };

      const encoded = encodeObjectToBase64UrlSafe(largeObj);
      expect(isValidBase64UrlSafe(encoded)).toBe(true);

      const decoded = decodeObjectFromBase64UrlSafe<typeof largeObj>(encoded);
      expect(decoded).toEqual(largeObj);
    });

    it('should handle special characters in strings', () => {
      const obj = {
        text: 'Hello! @#$%^&*()_+-=[]{}|;:\'",.<>?/`~',
        unicode: '你好 مرحبا שלום नमस्ते こんにちは',
        emoji: '😀🎉🚀💡🌟'
      };

      const encoded = encodeObjectToBase64UrlSafe(obj);
      expect(isValidBase64UrlSafe(encoded)).toBe(true);

      const decoded = decodeObjectFromBase64UrlSafe<typeof obj>(encoded);
      expect(decoded).toEqual(obj);
    });
  });

  describe('URL safety', () => {
    it('should produce strings safe for URLs', () => {
      const testData = [
        'Hello World!',
        '{"key":"value"}',
        'test@example.com',
        'user?id=123&name=test',
        '/path/to/resource',
        'a+b=c'
      ];

      for (const input of testData) {
        const encoded = encodeBase64UrlSafe(input);

        // Should not contain URL-unsafe characters
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');
        expect(encoded).not.toContain(' ');
        expect(encoded).not.toContain('?');
        expect(encoded).not.toContain('&');

        // Should be decodable
        const decoded = decodeBase64UrlSafe(encoded);
        expect(decoded).toBe(input);
      }
    });

    it('should be usable in query parameters', () => {
      const config = { theme: 'dark', lang: 'en' };
      const encoded = encodeObjectToBase64UrlSafe(config);

      // Simulate URL usage
      const url = `https://example.com?config=${encoded}`;
      expect(url).not.toContain('+');
      expect(url).not.toContain('=&'); // No padding-related issues

      // Extract and decode
      const params = new URLSearchParams(url.split('?')[1]);
      const extractedConfig = params.get('config');
      expect(extractedConfig).toBe(encoded);
      expect(extractedConfig).toBeTruthy();

      const decoded = decodeObjectFromBase64UrlSafe(extractedConfig) as typeof config;
      expect(decoded).toEqual(config);
    });
  });

  describe('error handling', () => {
    it('should handle decode errors gracefully', () => {
      expect(() => decodeBase64UrlSafe('!!!invalid!!!')).toThrow();
      expect(() => decodeBase64UrlSafe('not base64 @#$')).toThrow();
    });

    it('should handle invalid JSON in object decode', () => {
      // Create a valid base64 string that contains invalid JSON
      const invalidJson = encodeBase64UrlSafe('{invalid json}');
      expect(() => decodeObjectFromBase64UrlSafe(invalidJson)).toThrow();
    });
  });
});
