import LZString from 'lz-string';
import { describe, it, expect } from 'vitest';

import { testEncoderRoundtrip } from '../../test/helpers/encoder-helpers';
import { Prompt, ErrorType } from '../../types';
import {
  encode,
  decode,
  sanitizeText,
  validatePromptData,
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

// Helper to capture thrown error for property assertions
function captureError(fn: () => void): Error {
  try {
    fn();
    throw new Error('Expected function to throw');
  } catch (err) {
    return err as Error;
  }
}

describe('PromptEncoder', () => {
  describe('sanitizeText', () => {
    it('should remove HTML tags', () => {
      const result = sanitizeText('<script>alert("xss")</script>Test');
      expect(result).toBe('Test');
    });

    it('should remove all HTML tags from all fields', () => {
      expect(sanitizeText('<b>Bold</b> text')).toBe('Bold text');
      expect(sanitizeText('<img src=x onerror=alert(1)>Cat')).toBe('Cat');
    });

    it('should trim whitespace', () => {
      expect(sanitizeText('  Test  ')).toBe('Test');
    });

    it('should handle plain text', () => {
      expect(sanitizeText('Normal text')).toBe('Normal text');
    });

    it('should handle empty strings', () => {
      expect(sanitizeText('')).toBe('');
      expect(sanitizeText('   ')).toBe('');
    });
  });

  describe('validatePromptData', () => {
    it('should pass validation for valid data', () => {
      const validData = {
        title: 'Test',
        content: 'Content',
        category: 'Category',
      };
      expect(() => validatePromptData(validData)).not.toThrow();
    });

    it('should throw PromptEncoderError for empty title', () => {
      const data = { title: '', content: 'Content', category: 'Category' };
      expect(() => validatePromptData(data)).toThrow('Title is required');
      const err = captureError(() => validatePromptData(data));
      expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
      expect(err).toHaveProperty('name', 'PromptEncoderError');
    });

    it('should throw PromptEncoderError for empty content', () => {
      const data = { title: 'Title', content: '', category: 'Category' };
      expect(() => validatePromptData(data)).toThrow('Content is required');
      const err = captureError(() => validatePromptData(data));
      expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
      expect(err).toHaveProperty('name', 'PromptEncoderError');
    });

    it('should throw PromptEncoderError for empty category', () => {
      const data = { title: 'Title', content: 'Content', category: '' };
      expect(() => validatePromptData(data)).toThrow('Category is required');
      const err = captureError(() => validatePromptData(data));
      expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
      expect(err).toHaveProperty('name', 'PromptEncoderError');
    });

    it('should throw PromptEncoderError for whitespace-only title', () => {
      const data = { title: '   ', content: 'Content', category: 'Category' };
      expect(() => validatePromptData(data)).toThrow('Title is required');
    });

    it('should throw PromptEncoderError for oversized title', () => {
      const data = {
        title: 'x'.repeat(150),
        content: 'Content',
        category: 'Category',
      };
      expect(() => validatePromptData(data)).toThrow('Title too long');
    });

    it('should throw PromptEncoderError for oversized content', () => {
      const data = {
        title: 'Title',
        content: 'x'.repeat(25_000),
        category: 'Category',
      };
      expect(() => validatePromptData(data)).toThrow('Content too long');
    });

    it('should throw PromptEncoderError for oversized category', () => {
      const data = {
        title: 'Title',
        content: 'Content',
        category: 'x'.repeat(100),
      };
      expect(() => validatePromptData(data)).toThrow('Category too long');
    });
  });

  describe('encode', () => {
    it('should encode a valid prompt', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
    });

    it('should produce URL-safe string', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      expect(encoded).toBeTruthy();
      expect(typeof encoded).toBe('string');
      // Verify no unsafe characters
      expect(encoded).not.toMatch(/[\s<>"{}|\\^`]/);
    });

    it('should sanitize HTML in all fields', () => {
      const prompt = createTestPrompt({
        title: '<script>alert("xss")</script>Test',
        content: '<b>Bold</b> content',
        category: '<img src=x>Cat',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Test');
      expect(decoded.content).toBe('Bold content');
      expect(decoded.category).toBe('Cat');
    });

    it('should trim whitespace from all fields', () => {
      const prompt = createTestPrompt({
        title: '   Test   ',
        content: '   Content   ',
        category: '   Cat   ',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Test');
      expect(decoded.content).toBe('Content');
      expect(decoded.category).toBe('Cat');
    });

    it('should throw for empty title', () => {
      const prompt = createTestPrompt({ title: '' });
      expect(() => encode(prompt)).toThrow('Title is required');
    });

    it('should throw for oversized content', () => {
      const prompt = createTestPrompt({ content: 'x'.repeat(25_000) });
      expect(() => encode(prompt)).toThrow('too long');
    });

    it('should produce compressed output', () => {
      const prompt = createTestPrompt({
        content: 'A'.repeat(1000),
      });
      const encoded = encode(prompt);
      const uncompressed = JSON.stringify(prompt);
      // Encoded should be significantly smaller
      expect(encoded.length).toBeLessThan(uncompressed.length / 2);
    });
  });

  describe('decode', () => {
    it('should decode a valid encoded string', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    // eslint-disable-next-line vitest/expect-expect -- Assertion is in testEncoderRoundtrip helper
    it('should handle round-trip encoding/decoding', () => {
      const prompt = createTestPrompt({
        title: 'Complex Title',
        content: 'Complex content with special chars: !@#$%^*()',
        category: 'Complex Category',
      });
      testEncoderRoundtrip(prompt);
    });

    it('should throw PromptEncoderError for invalid encoded string', () => {
      expect(() => decode('invalid')).toThrow('Invalid sharing code format');
      const err = captureError(() => decode('invalid'));
      expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
      expect(err).toHaveProperty('name', 'PromptEncoderError');
    });

    it('should throw PromptEncoderError for corrupted encoded string', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      const corrupted = encoded.slice(0, -10);
      expect(() => decode(corrupted)).toThrow();
    });

    it('should apply defense-in-depth sanitization', () => {
      // Manually create payload with HTML (bypassing encode)
      const payload = {
        title: '<b>Test</b>',
        content: '<script>alert(1)</script>Content',
        category: '<img src=x>Cat',
      };
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
      const decoded = decode(encoded);
      // HTML should be stripped even though it's in the payload
      expect(decoded.title).toBe('Test');
      expect(decoded.content).toBe('Content');
      expect(decoded.category).toBe('Cat');
    });

    it('should throw PromptEncoderError for malformed JSON', () => {
      const malformed = LZString.compressToEncodedURIComponent('{invalid json}');
      expect(() => decode(malformed)).toThrow('Invalid sharing code format');
    });

    it('should throw PromptEncoderError for missing required fields', () => {
      const payload = { title: '', content: 'Content', category: 'Cat' };
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
      expect(() => decode(encoded)).toThrow('required');
    });
  });

  describe('Security', () => {
    it('should prevent XSS in title', () => {
      const prompt = createTestPrompt({
        title: '<script>alert("xss")</script>Malicious',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Malicious');
      expect(decoded.title).not.toContain('<script>');
    });

    it('should prevent XSS in content', () => {
      const prompt = createTestPrompt({
        content: '<img src=x onerror=alert("xss")>Content',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.content).toBe('Content');
      expect(decoded.content).not.toContain('<img');
      expect(decoded.content).not.toContain('onerror');
    });

    it('should prevent XSS in category', () => {
      const prompt = createTestPrompt({
        category: '<iframe src="evil.com"></iframe>Category',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.category).toBe('Category');
      expect(decoded.category).not.toContain('<iframe');
    });

    it('should handle multiple XSS vectors', () => {
      const prompt = createTestPrompt({
        title: '<script>alert(1)</script><b>Test</b>',
        content: '<img src=x onerror=alert(2)><i>Content</i>',
        category: '<a href="javascript:alert(3)">Cat</a>',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Test');
      expect(decoded.content).toBe('Content');
      expect(decoded.category).toBe('Cat');
    });
  });

  describe('Edge Cases', () => {
    // eslint-disable-next-line vitest/expect-expect -- Assertion is in testEncoderRoundtrip helper
    it('should handle special characters', () => {
      const prompt = createTestPrompt({
        title: '!@#$%^*()_+-=[]{}|;:",?/',
        content: 'Content with émojis 🎉🚀',
        category: 'Category with Ü̈mlaut',
      });
      testEncoderRoundtrip(prompt);
    });

    // eslint-disable-next-line vitest/expect-expect -- Assertion is in testEncoderRoundtrip helper
    it('should handle unicode characters', () => {
      const prompt = createTestPrompt({
        title: '中文标题',
        content: 'Contenu en français',
        category: 'Категория',
      });
      testEncoderRoundtrip(prompt);
    });

    // eslint-disable-next-line vitest/expect-expect -- Assertion is in testEncoderRoundtrip helper
    it('should handle maximum allowed sizes', () => {
      const prompt = createTestPrompt({
        title: 'x'.repeat(100),
        content: 'y'.repeat(20_000),
        category: 'z'.repeat(50),
      });
      testEncoderRoundtrip(prompt);
    });

    // eslint-disable-next-line vitest/expect-expect -- Assertion is in testEncoderRoundtrip helper
    it('should handle newlines and tabs', () => {
      const prompt = createTestPrompt({
        title: 'Title with\ttabs',
        content: 'Content\nwith\nnewlines',
        category: 'Category\rwith\rreturns',
      });
      testEncoderRoundtrip(prompt);
    });
  });

  describe('Decompression Bomb Protection', () => {
    it('should reject encoded strings exceeding size limit', () => {
      const hugeString = 'x'.repeat(45_000);
      expect(() => decode(hugeString)).toThrow('Sharing code too large');
    });

    it('should reject payloads exceeding decompressed size limit', () => {
      const payload = {
        title: 'Title',
        content: 'A'.repeat(25_000), // Over 20KB content limit
        category: 'Cat',
      };
      const encoded = LZString.compressToEncodedURIComponent(JSON.stringify(payload));
      expect(() => decode(encoded)).toThrow(/too large|too long/);
    });

    it('should accept legitimate payloads with normal compression', () => {
      const prompt = createTestPrompt({
        title: 'Test Prompt',
        content: 'This is a normal prompt with typical text. '.repeat(50),
        category: 'Test',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Test Prompt');
      expect(decoded.content).toContain('normal prompt');
      expect(decoded.category).toBe('Test');
    });

    it('should accept maximum valid content', () => {
      const normalText = 'Lorem ipsum dolor sit amet. ';
      const repetitions = Math.floor(20_000 / normalText.length);
      const content = normalText.repeat(repetitions).substring(0, 20_000);

      const prompt = createTestPrompt({
        title: 'Maximum Size Prompt',
        content,
        category: 'Test',
      });

      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Maximum Size Prompt');
      expect(decoded.content.length).toBeGreaterThanOrEqual(19900);
      expect(decoded.content.length).toBeLessThanOrEqual(20_000);
      expect(decoded.category).toBe('Test');
    });

    it('should accept realistic repetitive content', () => {
      const codeExample = 'function test() {\n  return true;\n}\n';
      const repeatedCode = codeExample.repeat(100);

      const prompt = createTestPrompt({
        title: 'Code Examples',
        content: repeatedCode,
        category: 'Programming',
      });

      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe('Code Examples');
      expect(decoded.content).toContain('function test()');
      expect(decoded.category).toBe('Programming');
    });
  });
});
