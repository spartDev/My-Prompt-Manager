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
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for empty content', () => {
      const data = { title: 'Title', content: '', category: 'Category' };
      expect(() => validatePromptData(data)).toThrow('Content is required');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for empty category', () => {
      const data = { title: 'Title', content: 'Content', category: '' };
      expect(() => validatePromptData(data)).toThrow('Category is required');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for whitespace-only title', () => {
      const data = { title: '   ', content: 'Content', category: 'Category' };
      expect(() => validatePromptData(data)).toThrow('Title is required');
      try {
        validatePromptData(data);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for oversized title', () => {
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

    it('should throw PromptEncoderError for oversized content', () => {
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

    it('should throw PromptEncoderError for oversized category', () => {
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
    it('should return consistent checksum for same input', () => {
      const data = 'Test data';
      const checksum1 = calculateChecksum(data);
      const checksum2 = calculateChecksum(data);
      expect(checksum1).toBe(checksum2);
    });

    it('should return different checksums for different inputs', () => {
      const checksum1 = calculateChecksum('Test 1');
      const checksum2 = calculateChecksum('Test 2');
      expect(checksum1).not.toBe(checksum2);
    });

    it('should return base36 string', () => {
      const checksum = calculateChecksum('Test');
      expect(checksum).toMatch(/^[0-9a-z]+$/);
    });
  });

  describe('verifyChecksum', () => {
    it('should not throw for valid checksum', () => {
      const data = 'Test data';
      const checksum = calculateChecksum(data);
      expect(() => verifyChecksum(data, checksum)).not.toThrow();
    });

    it('should throw PromptEncoderError for invalid checksum', () => {
      const data = 'Test data';
      expect(() => verifyChecksum(data, 'invalid')).toThrow('corrupted');
      try {
        verifyChecksum(data, 'invalid');
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
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
      // URL-safe characters only (alphanumeric, -, _)
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
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
      const prompt = createTestPrompt({ content: 'x'.repeat(20_000) });
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

    it('should handle round-trip encoding/decoding', () => {
      const prompt = createTestPrompt({
        title: 'Complex Title',
        content: 'Complex content with special chars: !@#$%^&*()',
        category: 'Complex Category',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded).toEqual({
        title: prompt.title,
        content: prompt.content,
        category: prompt.category,
      });
    });

    it('should throw PromptEncoderError for invalid encoded string', () => {
      expect(() => decode('invalid')).toThrow('Invalid sharing code format');
      try {
        decode('invalid');
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for corrupted encoded string', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      // Truncate to corrupt
      const corrupted = encoded.slice(0, -10);
      expect(() => decode(corrupted)).toThrow();
      try {
        decode(corrupted);
      } catch (err) {
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for unsupported version', () => {
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
      expect(() => decode(encoded)).toThrow('not supported');
      try {
        decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for invalid checksum', () => {
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
      expect(() => decode(encoded)).toThrow('corrupted');
      try {
        decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should apply defense-in-depth sanitization', () => {
      // Manually create payload with HTML (bypassing encode)
      // Note: checksum must match the raw payload data for verification to pass
      const payload = {
        v: '1.0',
        t: '<b>Test</b>',
        c: '<script>alert(1)</script>Content',
        cat: '<img src=x>Cat',
        cs: calculateChecksum('<b>Test</b>|<script>alert(1)</script>Content|<img src=x>Cat'),
      };
      const encoded = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      const decoded = decode(encoded);
      // HTML should be stripped even though it's in the payload
      expect(decoded.title).toBe('Test');
      expect(decoded.content).toBe('Content');
      expect(decoded.category).toBe('Cat');
    });

    it('should throw PromptEncoderError for malformed JSON', () => {
      const malformed = LZString.compressToEncodedURIComponent('{invalid json}');
      expect(() => decode(malformed)).toThrow('Invalid sharing code format');
      try {
        decode(malformed);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should throw PromptEncoderError for missing required fields', () => {
      const payload = {
        v: '1.0',
        t: '',
        c: 'Content',
        cat: 'Cat',
        cs: calculateChecksum('|Content|Cat'),
      };
      const encoded = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      expect(() => decode(encoded)).toThrow('required');
      try {
        decode(encoded);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.VALIDATION_ERROR);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
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

  describe('Data Integrity', () => {
    it('should detect tampered title', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      const decoded = LZString.decompressFromEncodedURIComponent(encoded);
      const payload = JSON.parse(decoded);
      // Tamper with title
      payload.t = 'Modified';
      const tampered = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      expect(() => decode(tampered)).toThrow('corrupted');
      try {
        decode(tampered);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should detect tampered content', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      const decoded = LZString.decompressFromEncodedURIComponent(encoded);
      const payload = JSON.parse(decoded);
      // Tamper with content
      payload.c = 'Modified Content';
      const tampered = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      expect(() => decode(tampered)).toThrow('corrupted');
      try {
        decode(tampered);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });

    it('should detect tampered category', () => {
      const prompt = createTestPrompt();
      const encoded = encode(prompt);
      const decoded = LZString.decompressFromEncodedURIComponent(encoded);
      const payload = JSON.parse(decoded);
      // Tamper with category
      payload.cat = 'Modified Category';
      const tampered = LZString.compressToEncodedURIComponent(
        JSON.stringify(payload)
      );
      expect(() => decode(tampered)).toThrow('corrupted');
      try {
        decode(tampered);
      } catch (err) {
        expect(err).toHaveProperty('type', ErrorType.DATA_CORRUPTION);
        expect(err).toHaveProperty('name', 'PromptEncoderError');
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters', () => {
      const prompt = createTestPrompt({
        // DOMPurify escapes &, <, > as HTML entities
        title: '!@#$%^*()_+-=[]{}|;:",?/',
        content: 'Content with émojis 🎉🚀',
        category: 'Category with Ü̈mlaut',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should handle unicode characters', () => {
      const prompt = createTestPrompt({
        title: '中文标题',
        content: 'Contenu en français',
        category: 'Категория',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should handle maximum allowed sizes', () => {
      const prompt = createTestPrompt({
        title: 'x'.repeat(100), // Max allowed
        content: 'y'.repeat(10_000), // Max allowed
        category: 'z'.repeat(50), // Max allowed
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });

    it('should handle newlines and tabs', () => {
      const prompt = createTestPrompt({
        title: 'Title with\ttabs',
        content: 'Content\nwith\nnewlines',
        category: 'Category\rwith\rreturns',
      });
      const encoded = encode(prompt);
      const decoded = decode(encoded);
      expect(decoded.title).toBe(prompt.title);
      expect(decoded.content).toBe(prompt.content);
      expect(decoded.category).toBe(prompt.category);
    });
  });
});
