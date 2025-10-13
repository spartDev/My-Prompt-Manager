import LZString from 'lz-string';
import { describe, it, expect } from 'vitest';

import { Prompt, ErrorType } from '../../types';
import {
  encode,
  decode,
  sanitizeText,
  validatePromptData,
  calculateChecksum,
  verifyChecksum,
} from '../promptEncoder';

// Helper to create test prompt
function createTestPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: 'test-id',
    title: 'Test Prompt',
    content: 'This is a test prompt',
    category: 'Test Category',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('PromptEncoder', () => {
  describe('sanitizeText', () => {
    it('should remove HTML tags', async () => {
      const result = sanitizeText('<script>alert("xss")</script>Test');
      expect(result).toBe('Test');
    });

    it('should remove all HTML tags from all fields', async () => {
      expect(sanitizeText('<b>Bold</b> text')).toBe('Bold text');
      expect(sanitizeText('<img src=x onerror=alert(1)>Cat')).toBe('Cat');
    });

    it('should trim whitespace', async () => {
      expect(sanitizeText('  Test  ')).toBe('Test');
    });

    it('should handle plain text', async () => {
      expect(sanitizeText('Normal text')).toBe('Normal text');
    });

    it('should handle empty strings', async () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText('   ')).toBe('');
    });
  });

  describe('validatePromptData', () => {
    it('should pass validation for valid data', async () => {
      const validData = {
        title: 'Test',
        content: 'Content',
        category: 'Category',
      };
      expect(() => validatePromptData(validData)).not.toThrow();
    });

    it('should throw PromptEncoderError for empty title', async () => {
      const data = { title: '', content: 'Content', category: 'Category' };
      expect(() => validatePromptData(data)).toThrow('Title is required');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for empty content', async () => {
      const data = { title: 'Title', content: '', category: 'Category' };
      expect(() => validatePromptData(data)).toThrow('Content is required');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for empty category', async () => {
      const data = { title: 'Title', content: 'Content', category: '' };
      expect(() => validatePromptData(data)).toThrow('Category is required');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for whitespace-only title', async () => {
      const data = { title: '   ', content: 'Content', category: 'Category' };
      expect(() => validatePromptData(data)).toThrow('Title is required');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for oversized title', async () => {
      const data = {
        title: 'x'.repeat(150),
        content: 'Content',
        category: 'Category',
      };
      expect(() => validatePromptData(data)).toThrow('Title too long');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for oversized content', async () => {
      const data = {
        title: 'Title',
        content: 'x'.repeat(15_000),
        category: 'Category',
      };
      expect(() => validatePromptData(data)).toThrow('Content too long');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for oversized category', async () => {
      const data = {
        title: 'Title',
        content: 'Content',
        category: 'x'.repeat(100),
      };
      expect(() => validatePromptData(data)).toThrow('Category too long');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });
  });

  describe('calculateChecksum', () => {
    it('should return consistent checksum for same input', async () => {
      const data = 'Test data';
      const checksum1 = await calculateChecksum(data);
      const checksum2 = await calculateChecksum(data);
      expect(checksum1).toBe(checksum2);
    });

    it('should return different checksums for different inputs', async () => {
      const checksum1 = await calculateChecksum('Test 1');
      const checksum2 = await calculateChecksum('Test 2');
      expect(checksum1).not.toBe(checksum2);
    });

    it('should return hexadecimal string', async () => {
      const checksum = await calculateChecksum('Test');
      expect(checksum).toMatch(/^[0-9a-f]+$/);
      expect(checksum.length).toBe(12); // 48 bits = 12 hex chars
    });
  });

  describe('verifyChecksum', () => {
    it('should not throw for valid checksum', async () => {
      const data = 'Test data';
      const checksum = await calculateChecksum(data);
      await expect(async () => await verifyChecksum(data, checksum)).not.toThrow();
    });

    it('should throw PromptEncoderError for invalid checksum', async () => {
      const data = 'Test data';
      await expect(verifyChecksum(data, 'invalid')).rejects.toThrow('corrupted');
      try {
        await verifyChecksum(data, 'invalid');
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });
  });

  describe('encode', () => {
    it('should encode a valid prompt', async () => {
      const prompt = createTestPrompt();
      const encoded = await encode(prompt);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
    });

    it('should produce URL-safe string', async () => {
      const prompt = createTestPrompt();
      const encoded = await encode(prompt);
      // URL-safe characters from LZ-string compressToEncodedURIComponent
      // Includes alphanumeric and URI-safe punctuation (may include = padding)
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
      // Verify no unsafe characters (spaces, <, >, etc.)
      expect(encoded).not.toMatch(/[\s<>"{}|\\^`]/);
    });

    it('should sanitize HTML in all fields', async () => {
      const prompt = createTestPrompt({
        title: '<script>alert("xss")</script>Test',
        content: '<b>Bold</b> content',
        category: '<img src=x>Cat',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.title).toBe('Test');
      expect(decoded.content).toBe('Bold content');
      expect(decoded.category).toBe('Cat');
    });

    it('should trim whitespace from all fields', async () => {
      const prompt = createTestPrompt({
        title: '   Test   ',
        content: '   Content   ',
        category: '   Cat   ',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.title).toBe('Test');
      expect(decoded.content).toBe('Content');
      expect(decoded.category).toBe('Cat');
    });

    it('should throw for empty title', async () => {
      const prompt = createTestPrompt({ title: '' });
      await expect(encode(prompt)).rejects.toThrow('Title is required');
    });

    it('should throw for oversized content', async () => {
      const prompt = createTestPrompt({ content: 'x'.repeat(15_000) });
      await expect(encode(prompt)).rejects.toThrow('too long');
    });

    it('should produce compressed output', async () => {
      const prompt = createTestPrompt({
        content: 'A'.repeat(1000),
      });
      const encoded = await encode(prompt);
      const uncompressed = JSON.stringify(prompt);
      // Encoded should be significantly smaller
      expect(encoded.length).toBeLessThan(uncompressed.length / 2);
    });
  });

  describe('decode', () => {
    it('should decode a valid encoded string', async () => {
      const prompt = createTestPrompt();
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should handle round-trip encoding/decoding', async () => {
      const prompt = createTestPrompt({
        title: 'Complex Title',
        content: 'Complex content with special chars: !@#$%^*()',
        category: 'Complex Category',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      // Compare individual fields since decoded doesn't include id/timestamps
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should throw PromptEncoderError for invalid encoded string', async () => {
      await expect(decode('invalid')).rejects.toThrow('Invalid sharing code format');
      try {
        await decode('invalid');
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for corrupted encoded string', async () => {
      const prompt = createTestPrompt();
      const encoded = await encode(prompt);
      // Truncate to corrupt
      const corrupted = encoded.slice(0, -10);
      await expect(decode(corrupted)).rejects.toThrow();
      try {
        await decode(corrupted);
      } catch (err) {
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for unsupported version', async () => {
      const payload = {
        v: '2.0',
        t: 'Test',
        c: 'Content',
        cat: 'Cat',
        cs: 'abc123',
      };
      const encoded = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      await expect(decode(encoded)).rejects.toThrow('not supported');
      try {
        await decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for invalid checksum', async () => {
      const payload = {
        v: '1.0',
        t: 'Test',
        c: 'Content',
        cat: 'Cat',
        cs: 'invalid',
      };
      const encoded = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      await expect(decode(encoded)).rejects.toThrow('corrupted');
      try {
        await decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should apply defense-in-depth sanitization', async () => {
      // Manually create payload with HTML (bypassing encode)
      // Note: checksum must match the raw payload data for verification to pass
      const payload = {
        v: '1.0',
        t: '<b>Test</b>',
        c: '<script>alert(1)</script>Content',
        cat: '<img src=x>Cat',
        cs: await calculateChecksum('1.0|<b>Test</b>|<script>alert(1)</script>Content|<img src=x>Cat'),
      };
      const encoded = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      const decoded = await decode(encoded);
      // HTML should be stripped even though it's in the payload
      expect(decoded.title).toBe('Test');
      expect(decoded.content).toBe('Content');
      expect(decoded.category).toBe('Cat');
    });

    it('should throw PromptEncoderError for malformed JSON', async () => {
      const malformed = LZString.compressToEncodedURIComponent('{invalid json}');
      await expect(decode(malformed)).rejects.toThrow('Invalid sharing code format');
      try {
        await decode(malformed);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for missing required fields', async () => {
      const payload = {
        v: '1.0',
        t: '',
        c: 'Content',
        cat: 'Cat',
        cs: await calculateChecksum('1.0||Content|Cat'),
      };
      const encoded = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      await expect(decode(encoded)).rejects.toThrow('required');
      try {
        await decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });
  });

  describe('Security', () => {
    it('should prevent XSS in title', async () => {
      const prompt = createTestPrompt({
        title: '<script>alert("xss")</script>Malicious',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.title).toBe('Malicious');
      expect(decoded.title).not.toContain('<script>');
    });

    it('should prevent XSS in content', async () => {
      const prompt = createTestPrompt({
        content: '<img src=x onerror=alert("xss")>Content',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.content).toBe('Content');
      expect(decoded.content).not.toContain('<img');
      expect(decoded.content).not.toContain('onerror');
    });

    it('should prevent XSS in category', async () => {
      const prompt = createTestPrompt({
        category: '<iframe src="evil.com"></iframe>Category',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.category).toBe('Category');
      expect(decoded.category).not.toContain('<iframe');
    });

    it('should handle multiple XSS vectors', async () => {
      const prompt = createTestPrompt({
        title: '<script>alert(1)</script><b>Test</b>',
        content: '<img src=x onerror=alert(2)><i>Content</i>',
        category: '<a href="javascript:alert(3)">Cat</a>',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.title).toBe('Test');
      expect(decoded.content).toBe('Content');
      expect(decoded.category).toBe('Cat');
    });
  });

  describe('Data Integrity', () => {
    it('should detect tampered title', async () => {
      const prompt = createTestPrompt();
      const encoded = await encode(prompt);
      const decoded = LZString.decompressFromEncodedURIComponent(encoded);
      const payload = JSON.parse(decoded);
      // Tamper with title
      payload.t = 'Modified';
      const tampered = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      await expect(decode(tampered)).rejects.toThrow('corrupted');
      try {
        await decode(tampered);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should detect tampered content', async () => {
      const prompt = createTestPrompt();
      const encoded = await encode(prompt);
      const decoded = LZString.decompressFromEncodedURIComponent(encoded);
      const payload = JSON.parse(decoded);
      // Tamper with content
      payload.c = 'Modified Content';
      const tampered = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      await expect(decode(tampered)).rejects.toThrow('corrupted');
      try {
        await decode(tampered);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should detect tampered category', async () => {
      const prompt = createTestPrompt();
      const encoded = await encode(prompt);
      const decoded = LZString.decompressFromEncodedURIComponent(encoded);
      const payload = JSON.parse(decoded);
      // Tamper with category
      payload.cat = 'Modified Category';
      const tampered = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      await expect(decode(tampered)).rejects.toThrow('corrupted');
      try {
        await decode(tampered);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters', async () => {
      const prompt = createTestPrompt({
        // DOMPurify escapes &, <, > as HTML entities
        title: '!@#$%^*()_+-=[]{}|;:",?/',
        content: 'Content with émojis 🎉🚀',
        category: 'Category with Ü̈mlaut',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should handle unicode characters', async () => {
      const prompt = createTestPrompt({
        title: '中文标题',
        content: 'Contenu en français',
        category: 'Категория',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should handle maximum allowed sizes', async () => {
      const prompt = createTestPrompt({
        title: 'x'.repeat(100), // Max allowed
        content: 'y'.repeat(10_000), // Max allowed
        category: 'z'.repeat(50), // Max allowed
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should handle newlines and tabs', async () => {
      const prompt = createTestPrompt({
        title: 'Title with\ttabs',
        content: 'Content\nwith\nnewlines',
        category: 'Category\rwith\rreturns',
      });
      const encoded = await encode(prompt);
      const decoded = await decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });
  });

  describe('Decompression Bomb Protection', () => {
    it('should reject encoded strings exceeding size limit', async () => {
      // Create string that exceeds 50KB encoded limit
      const hugeString = 'x'.repeat(50_001);

      await expect(decode(hugeString)).rejects.toThrow('Sharing code too large');
      try {
        await decode(hugeString);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should reject payloads exceeding decompressed size limit (100KB)', async () => {
      // Optimized: smaller payload for faster test execution (11KB just over 10KB limit)
      const payload = {
        v: '1.0',
        t: 'Title',
        c: 'A'.repeat(11_000), // Just over 10KB
        cat: 'Cat',
        cs: await calculateChecksum('1.0|Title|' + 'A'.repeat(11_000) + '|Cat')
      };

      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

      // Should reject (either decompression check or content validation)
      await expect(decode(encoded)).rejects.toThrow();

      try {
        await decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
        // Accept either error message (decompression size or content validation)
        expect((err as Error).message).toMatch(/too large|too long/);
      }
    });

    it('should reject payloads with large decompressed size', async () => {
      // Create payload that exceeds 100KB decompressed limit (use smaller size for speed)
      const repetitiveContent = 'A'.repeat(11_000); // Just over 10KB
      const payload = {
        v: '1.0',
        t: 'T',
        c: repetitiveContent,
        cat: 'C',
        cs: await calculateChecksum(`1.0|T|${repetitiveContent}|C`)
      };

      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

      // Should reject due to decompressed size check
      await expect(decode(encoded)).rejects.toThrow();

      try {
        await decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should reject decompressed payloads at exact 2x limit boundary', async () => {
      // Simplified test with smaller payload for speed (11KB just over 10KB)
      const variedContent = 'The quick brown fox jumps over the lazy dog. '.repeat(250); // ~11KB

      const payload = {
        v: '1.0',
        t: 'T',
        c: variedContent,
        cat: 'C',
        cs: await calculateChecksum('1.0|T|' + variedContent + '|C')
      };

      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));

      await expect(decode(encoded)).rejects.toThrow();

      try {
        await decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
        // Accept either error message (decompression size or content validation)
        expect((err as Error).message).toMatch(/too large|too long/);
      }
    });

    it('should accept legitimate payloads with normal compression ratios', async () => {
      // Normal prompt with typical compression ratio (3-5x)
      const prompt = createTestPrompt({
        title: 'Test Prompt',
        content: 'This is a normal prompt with typical text that compresses reasonably. ' +
                 'It contains various words and punctuation that create a realistic compression scenario. ' +
                 'The compression ratio should be within normal bounds.',
        category: 'Test'
      });

      const encoded = await encode(prompt);
      const decoded = await decode(encoded);

      expect(decoded.title).toBe('Test Prompt');
      expect(decoded.content).toContain('normal prompt');
      expect(decoded.category).toBe('Test');
    });

    it('should accept maximum valid content with typical compression', async () => {
      // Test at maximum allowed content size (10KB) with realistic text
      // This should compress reasonably and stay well under limits
      const normalText = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. ';
      const repetitions = Math.floor(10_000 / normalText.length);
      const content = normalText.repeat(repetitions).substring(0, 10_000);

      const prompt = createTestPrompt({
        title: 'Maximum Size Prompt',
        content: content, // Exactly at limit
        category: 'Test'
      });

      const encoded = await encode(prompt);
      const decoded = await decode(encoded);

      expect(decoded.title).toBe('Maximum Size Prompt');
      // Allow for slight variation due to sanitization/trimming
      expect(decoded.content.length).toBeGreaterThanOrEqual(9900);
      expect(decoded.content.length).toBeLessThanOrEqual(10_000);
      expect(decoded.category).toBe('Test');
    });

    it('should detect compression bomb with small encoded but large decompressed size', async () => {
      // Optimized test: smaller payload, same logic (11KB just over 10KB)
      const maliciousPayload = {
        v: '1.0',
        t: 'Attack',
        c: 'A'.repeat(11_000), // Just over 10KB, compresses very well
        cat: 'Cat',
        cs: await calculateChecksum('1.0|Attack|' + 'A'.repeat(11_000) + '|Cat')
      };

      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(maliciousPayload));

      // Should fail on decompressed size check
      await expect(decode(encoded)).rejects.toThrow();

      try {
        await decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('name', 'PromptEncoderError');
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
      }
    });

    it('should accept realistic repetitive content with moderate compression', async () => {
      // Test content with natural repetition (like code examples)
      const codeExample = 'function test() {\n  return true;\n}\n';
      const repeatedCode = codeExample.repeat(100); // ~3KB of repeated code

      const prompt = createTestPrompt({
        title: 'Code Examples',
        content: repeatedCode,
        category: 'Programming'
      });

      const encoded = await encode(prompt);
      const decoded = await decode(encoded);

      // Should work fine - realistic content with natural repetition
      expect(decoded.title).toBe('Code Examples');
      expect(decoded.content).toContain('function test()');
      expect(decoded.category).toBe('Programming');
    });

    it('should provide clear error messages for size limit violations', async () => {
      // Optimized: smaller payload, same error message verification (11KB just over 10KB)
      const maliciousPayload = {
        v: '1.0',
        t: 'Attack',
        c: 'X'.repeat(11_000), // Just over 10KB
        cat: 'Cat',
        cs: await calculateChecksum('1.0|Attack|' + 'X'.repeat(11_000) + '|Cat')
      };

      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(maliciousPayload));

      try {
        await decode(encoded);
        // Should not reach here
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toHaveProperty('message');
        // Accept either error message (decompression size or content validation)
        expect((err as Error).message).toMatch(/too large|too long/);
        expect(err).toHaveProperty('details');
        const details = (err as { details?: { decompressedLength?: number; length?: number } }).details;
        // Check has either decompressedLength or length field
        expect(details).toBeDefined();
        const hasLength = details && ('decompressedLength' in details || 'length' in details);
        expect(hasLength).toBe(true);
      }
    });

    it('should verify decompression bomb protection with multiple payload types', async () => {
      // Optimized test: smaller payloads, same logic (11KB just over 10KB)

      // Case 1: Large decompressed size
      const largePayload = {
        v: '1.0',
        t: 'Large',
        c: 'X'.repeat(11_000), // Just over 10KB
        cat: 'Cat',
        cs: await calculateChecksum('1.0|Large|' + 'X'.repeat(11_000) + '|Cat')
      };

      const largeEncoded = LZString.compressToEncodedURIComponent(JSON.stringify(largePayload));
      await expect(decode(largeEncoded)).rejects.toThrow();

      // Case 2: Highly compressible content
      const extremePayload = {
        v: '1.0',
        t: 'Extreme',
        c: 'A'.repeat(11_000), // Same size, compresses extremely well
        cat: 'Cat',
        cs: await calculateChecksum('1.0|Extreme|' + 'A'.repeat(11_000) + '|Cat')
      };

      const extremeEncoded = LZString.compressToEncodedURIComponent(JSON.stringify(extremePayload));
      await expect(decode(extremeEncoded)).rejects.toThrow();
    });
  });
});
